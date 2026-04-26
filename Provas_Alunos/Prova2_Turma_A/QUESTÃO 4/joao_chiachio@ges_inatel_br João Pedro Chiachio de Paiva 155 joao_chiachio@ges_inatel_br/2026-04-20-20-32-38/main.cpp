#include <iostream>
#include <iomanip>
#include <cstring>

using namespace std;

int main ()
{
    int numeros[1000];
    int n, media = 0;
    float pares = 0, impar = 0;
    char palavra;
 
    
    cin >> n;
    
    while(n != 0)
    {
        for(int i = 0; i < n; i++)
        {
            cin >> numeros[i];
            if(numeros[i] % 2 == 0)
                pares += numeros[i];
                
            else if (numeros[i] % 2 != 0)
                impar += numeros[i];
        }
        
        char nome (palavra, 50)
        cin.getline(palavra,50)
        cin.ignore();
        
            if(strcmp (palavra, "positivos") == 0)
            {
                media = pares / n;
                cout << media << endl;
            }
            else if(strcmp (palavra, "negativos") == 0)
            {
                media = impar / n; 
                cout << media << endl;
            }
            
            cin >> n;
        
    }    
    
    return 0;
}