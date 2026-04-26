#include <iostream>
#include <iomanip>
#include <cmath>
#include <cstring>

using namespace std;

int main ()
{    
    int quantidade = 0, quantidadePositivos = 0, quantidadeNegativos = 0;
    int numero = 2;
    double somaPositivos = 0, somaNegativos = 0, media;
    int vetor [1000];
    char string [50];
    char positivos[50];
    char negativos [50];
    
    while ( numero != 0)
    {
        cin >> numero;
        
        vetor[quantidade] = numero;
        quantidade++;
    }
    
    quantidade = quantidade - 1; // por conta do 0
    
    for (int i = 0; i<quantidade; i++)
    {
        if (vetor[i] > 0)
        {
            somaPositivos += vetor [i];
            quantidadePositivos++;
        }
        
        else 
        {
            somaNegativos += vetor[i];
            quantidadeNegativos++;
        }
        
    }
    
     strcpy (positivos, "positivos");
     strcpy (negativos, "negativos");
     
     cin.ignore();
     cin.getline(string,50);
     
     if (strcmp(string, positivos) == 0)
     {
         media =  somaPositivos / quantidadePositivos;
     }
     
    else if (strcmp(string, negativos) == 0)
     {
         media =  somaNegativos / quantidadeNegativos;
     }
    
    cout << fixed << setprecision(3);
    cout << "media = " << media;
    return 0;
}