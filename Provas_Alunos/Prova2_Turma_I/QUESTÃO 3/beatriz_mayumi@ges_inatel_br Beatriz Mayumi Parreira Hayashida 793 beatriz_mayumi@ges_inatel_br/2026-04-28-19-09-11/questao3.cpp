#include <iostream>
#include <iomanip>
using namespace std;

int main()
{
    int avaliacao[1000];
    int i = 0;
    
    do
    {
        cin >> avaliacao[i];
        
        if (avaliacao[i]!= 6)
        {
        i++;
        }
    }
    while (avaliacao[i] != 6);
    
    int um = 0, dois = 0, tres = 0, quatro = 0, cinco = 0;
    for (int o = 0; o < i; o++)
    {
        if(avaliacao[o] == 1)
        {
            um++;
        }
        else if(avaliacao[o] == 2)
        {
            dois++;
        }
        else if(avaliacao[o] == 3)
        {
            tres++;
        }
        else if(avaliacao[o] == 4)
        {
            quatro++;
        }
        else if(avaliacao[o] == 5)
        {
            cinco++;
        }
    }
    
    double resultado1 = (um/i)*100;
    double resultado2 = (dois/i)*100;
    double resultado3 = (tres/i)*100;
    double resultado4 = (quatro/i)*100;
    double resultado5 = (cinco/i)*100;
        
    cout << fixed << setprecision(2);
    cout << "1 estrela: " << resultado1 << "%" << endl;
    cout << "2 estrela: " << resultado2 << "%" << endl;
    cout << "3 estrela: " << resultado3 << "%" << endl;
    cout << "4 estrela: " << resultado4 << "%"<< endl;
    cout << "5 estrela: " << resultado5 << "%"<< endl;
    
    return 0;
}