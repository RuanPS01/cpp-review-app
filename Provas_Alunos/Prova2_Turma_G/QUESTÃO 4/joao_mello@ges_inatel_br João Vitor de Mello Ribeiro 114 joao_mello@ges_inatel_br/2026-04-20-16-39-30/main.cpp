#include <iostream>
#include <iomanip>


using namespace std;

int main()
{
    double vetor[20];
    
    double numeros;
    double procura;
    int i = 0;
    int pos = -1;
    
    cin >> numeros;
    
    while(numeros != 0)
    {
        vetor[i] = numeros;
        i++;
        
        cin >> numeros;
    }
    
    cin >> procura;
    
    
    for(int j = 0; j < i; j++)
    {
        if(vetor[j] == procura)
        {
            
            pos = j;
            break;
        }
        
    }
   
   
    if(pos != -1)
    {
        cout << procura << " encontrado na posicao " << pos << endl;
       
    }
    else 
        cout << "Elemento nao encontrado" << endl;
    
    return 0;
    
    
    // nao consegui colocar o .0 no 5
}