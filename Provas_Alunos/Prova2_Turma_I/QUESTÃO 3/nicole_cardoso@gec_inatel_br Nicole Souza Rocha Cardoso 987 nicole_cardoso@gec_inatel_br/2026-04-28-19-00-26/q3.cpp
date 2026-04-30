#include <iostream>
#include <iomanip>
using namespace std;

int main()
{
    int estrela[1000], cont = 1, i = 0, total;
    int uma = 0, duas = 0, tres = 0, quatro = 0, cinco = 0;
    
    int u = 1, d = 2, t = 3, q = 4, c = 5;
    
    do 
    {
        cin >> estrela[i];
        
        cont = cont + 1;
        
    }while (estrela[i] == 6);
    
    cout << " cont" << cont << endl;
    
    for (int j = 0; j < cont; j++)
    {
        if(estrela[j] == (1))
        {
            uma =uma + 1;
            cout << " uma" <<  uma << endl;
        }
        
        if(estrela[j] == '2')
        {
            duas = duas + 1;
            cout << " duas" <<  duas << endl;
        }
        
        if(estrela[j] == 't')
        {
            tres = tres + 1;
        }
        
        if(estrela[j] == 'q')
        {
            quatro++;
        }
        
        if(estrela[j] == 'c')
        {
            cinco += 1;
        }
    }
    
    total = uma + duas + tres + quatro + cinco;
    
    uma = (uma/ total) * 100;
    duas = (duas / total) * 100;
    tres = (tres / total) * 100;
    quatro = (quatro / total) * 100;
    cinco = (cinco / total) * 100;
    
    cout << fixed << setprecision(2);
    cout << "1 estrela: " << uma << "%" << endl;
    cout << "2 estrelas: " << duas << "%" << endl;
    cout << "3 estrelas: " << tres << "%" << endl;
    cout << "4 estrelas: " << quatro << "%" << endl;
    cout << "5 estrelas: " << cinco << "%" << endl;
    
    return 0;
}