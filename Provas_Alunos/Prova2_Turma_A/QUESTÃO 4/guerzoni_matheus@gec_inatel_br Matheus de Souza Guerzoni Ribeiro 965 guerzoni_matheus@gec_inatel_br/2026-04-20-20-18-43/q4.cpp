#include <iostream>
#include <cstring>
#include <iomanip>

using namespace std;

int main(){
    
    int Ns[100],N,i = 0;
    char positivos[10],negativos[10],escolha[10];
    double soma = 0,media,ns = 0;
    
    strcpy(positivos,"positivos");
    strcpy(negativos,"negativos");
    
    do
    {
        cin >> N;
        
        if(N != 0)
        {
            Ns[i] = N;
            i++;
        }
        
    }while(N != 0);
    
    cin.ignore();
    cin.getline(escolha,10);
    
    if(strcmp(positivos,escolha) == 0)
    {
        for(int I = 0;I < i;I++)
        {
            if(Ns[I] > 0)
            {
                soma += Ns[I];
                ns++;
            }
        }   
    }
    
    if(strcmp(negativos,escolha) == 0)
    {
            for(int I = 0;I < i;I++)
            {
                if(Ns[I] < 0)
                {
                    soma += Ns[I];
                    ns++;
                }
            }
    }
    
    media = soma / ns;
    
    cout << fixed << setprecision(3);
    cout << "media = " << media << endl;
    
    
    return 0;
}